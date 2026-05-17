import asyncio
import re

import httpx

from config import settings

EXECD_PORT = 44772
VSCODE_PORT = 8443


async def list_sandboxes() -> list[dict]:
    async with httpx.AsyncClient(base_url=settings.opensandbox_url, timeout=60.0) as client:
        resp = await client.get("/v1/sandboxes")
        resp.raise_for_status()
        data = resp.json()
        return data.get("items", [])


def _sanitize_label(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9\-_.]", "_", value)
    sanitized = sanitized.strip("_.-")
    return sanitized[:63]


async def create_sandbox(
    image: str,
    timeout: int,
    metadata: dict,
    entrypoint: list[str] | None = None,
    args: list[str] | None = None,
    env: dict | None = None,
) -> dict:
    safe_metadata = {k: _sanitize_label(str(v)) for k, v in metadata.items()}
    body: dict = {
        "image": {"uri": image},
        "timeout": timeout,
        "resourceLimits": {
            "cpu": settings.default_sandbox_cpu,
            "memory": settings.default_sandbox_memory,
        },
        "metadata": safe_metadata,
    }
    if entrypoint:
        body["entrypoint"] = entrypoint + (args or [])
    if env:
        body["env"] = env
    async with httpx.AsyncClient(base_url=settings.opensandbox_url, timeout=120.0) as client:
        resp = await client.post("/v1/sandboxes", json=body)
        resp.raise_for_status()
        return resp.json()


async def delete_sandbox(sandbox_id: str) -> None:
    async with httpx.AsyncClient(base_url=settings.opensandbox_url, timeout=15.0) as client:
        resp = await client.delete(f"/v1/sandboxes/{sandbox_id}")
        resp.raise_for_status()


async def fetch_logs(sandbox_id: str) -> str:
    async with httpx.AsyncClient(base_url=settings.opensandbox_url, timeout=15.0) as client:
        resp = await client.get(f"/v1/sandboxes/{sandbox_id}/diagnostics/logs")
        resp.raise_for_status()
        return resp.text


def _parse_execd_metrics(data: dict) -> dict[str, float | None]:
    """Normalize execd /metrics JSON to dashboard fields."""
    cpu = (
        data.get("cpu_used_pct")
        or data.get("cpu_used_percentage")
        or data.get("cpuUsedPercentage")
        or data.get("cpu_percent")
    )
    mem = (
        data.get("mem_used_mib")
        or data.get("memory_used_in_mib")
        or data.get("memoryUsedInMiB")
        or data.get("memory_mb")
    )
    return {
        "cpu_percent": float(cpu) if cpu is not None else None,
        "memory_mb": float(mem) if mem is not None else None,
    }


async def get_sandbox_metrics(sandbox_id: str) -> dict[str, float | None] | None:
    """Fetch live CPU/memory from execd via the OpenSandbox server proxy."""
    try:
        _, headers = await _fetch_endpoint(sandbox_id, EXECD_PORT)
        async with httpx.AsyncClient(
            base_url=settings.opensandbox_url, timeout=10.0
        ) as client:
            resp = await client.get(
                f"/v1/sandboxes/{sandbox_id}/proxy/{EXECD_PORT}/metrics",
                headers=headers,
            )
            resp.raise_for_status()
            return _parse_execd_metrics(resp.json())
    except Exception:
        return None


async def get_sandbox(sandbox_id: str) -> dict:
    async with httpx.AsyncClient(base_url=settings.opensandbox_url, timeout=15.0) as client:
        resp = await client.get(f"/v1/sandboxes/{sandbox_id}")
        resp.raise_for_status()
        return resp.json()


async def _fetch_endpoint(sandbox_id: str, port: int) -> tuple[str, dict[str, str]]:
    async with httpx.AsyncClient(base_url=settings.opensandbox_url, timeout=15.0) as client:
        resp = await client.get(f"/v1/sandboxes/{sandbox_id}/endpoints/{port}")
        resp.raise_for_status()
        data = resp.json()
        headers = data.get("headers") or {}
        return data["endpoint"], headers


def _browser_session_url(endpoint: str) -> str:
    """Normalize OpenSandbox endpoint to a URL reachable from the user's browser."""
    raw = endpoint.strip()
    if settings.opensandbox_session_host:
        # Replace host part when server returns host.docker.internal etc.
        if "://" in raw:
            _, _, rest = raw.partition("://")
        else:
            rest = raw
        slash = rest.find("/")
        path = rest[slash:] if slash >= 0 else ""
        port_part = rest[:slash] if slash >= 0 else rest
        if ":" in port_part:
            port = port_part.rsplit(":", 1)[1]
            raw = f"{settings.opensandbox_session_host}:{port}{path}"
        else:
            raw = f"{settings.opensandbox_session_host}{path}"
    if not raw.startswith(("http://", "https://")):
        raw = f"http://{raw}"
    return raw.rstrip("/") + "/"


async def get_sandbox_endpoint(sandbox_id: str, port: int) -> str:
    """Return a browser-reachable URL via the execd host-mapped /proxy/{port} tunnel."""
    endpoint, _ = await _fetch_endpoint(sandbox_id, port)
    return _browser_session_url(endpoint)


async def start_code_server(sandbox_id: str) -> None:
    """Start code-server inside the sandbox via execd (matches OpenSandbox vscode example)."""
    endpoint, headers = await _fetch_endpoint(sandbox_id, EXECD_PORT)
    base = _browser_session_url(endpoint).rstrip("/")
    body: dict = {
        "command": f"code-server --bind-addr 0.0.0.0:{VSCODE_PORT} --auth none /workspace",
        "cwd": "/workspace",
        "background": True,
    }
    req_headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        **headers,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST", f"{base}/command", json=body, headers=req_headers
        ) as resp:
            if resp.status_code >= 400:
                detail = (await resp.aread()).decode(errors="replace")
                raise RuntimeError(
                    f"code-server start failed ({resp.status_code}): {detail[:500]}"
                )
            async for line in resp.aiter_lines():
                if line and '"error"' in line.lower():
                    raise RuntimeError(f"code-server start error: {line[:500]}")


async def wait_for_code_server(
    sandbox_id: str,
    timeout_seconds: int = 60,
    poll_interval: float = 2.0,
) -> None:
    """Poll the execd /proxy/8443 URL until code-server responds."""
    endpoint, headers = await _fetch_endpoint(sandbox_id, VSCODE_PORT)
    url = _browser_session_url(endpoint)
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        while asyncio.get_event_loop().time() < deadline:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code < 500:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(poll_interval)
    raise TimeoutError(f"code-server on port {VSCODE_PORT} not reachable after {timeout_seconds}s")


async def create_vscode_sandbox(
    image: str,
    timeout: int,
    env: dict,
    metadata: dict,
) -> dict:
    """Create a sandbox; code-server is started later via execd."""
    return await create_sandbox(
        image=image,
        timeout=timeout,
        env=env,
        metadata=metadata,
        entrypoint=["/bin/bash", "-c"],
        args=["tail -f /dev/null"],
    )


async def wait_for_ready(
    sandbox_id: str,
    timeout_seconds: int = 60,
    poll_interval: float = 2.0,
) -> dict:
    """Poll until sandbox state is 'Running'. Raises TimeoutError or RuntimeError on failure."""
    import asyncio
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    while True:
        data = await get_sandbox(sandbox_id)
        status_raw = data.get("status") or {}
        state = (
            status_raw.get("state", "").lower()
            if isinstance(status_raw, dict)
            else str(status_raw).lower()
        )
        if state == "running":
            return data
        if state in ("error", "failed", "terminated"):
            raise RuntimeError(f"Sandbox {sandbox_id} entered state '{state}'")
        if asyncio.get_event_loop().time() >= deadline:
            raise TimeoutError(f"Sandbox {sandbox_id} not ready after {timeout_seconds}s")
        await asyncio.sleep(poll_interval)
