import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def _env_file() -> str:
    return os.getenv("ENV_FILE", ".env")


def _settings_config() -> SettingsConfigDict:
    kwargs: dict = {"env_file_encoding": "utf-8", "extra": "ignore"}
    path = _env_file()
    if os.path.isfile(path):
        kwargs["env_file"] = path
    return SettingsConfigDict(**kwargs)


class Settings(BaseSettings):
    model_config = _settings_config()

    opensandbox_url: str = "http://localhost:8080"
    # Public host for VS Code session URLs (must match OpenSandbox [server].eip).
    opensandbox_session_host: str = "localhost"
    # Host the BACKEND itself uses to reach sandbox ports (execd/code-server).
    # Empty = same as opensandbox_session_host. Set to host.docker.internal
    # when the backend runs inside a container but sandbox ports are on the host.
    opensandbox_internal_host: str = ""
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensandbox"
    redis_url: str = "redis://localhost:6379"
    poll_interval_seconds: int = 3
    activity_log_max_events: int = 50
    default_sandbox_cpu: str = "500m"
    default_sandbox_memory: str = "512Mi"
    default_sandbox_timeout: int = 600
    vscode_image: str = (
        "sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/vscode:latest"
    )
    session_ttl_seconds: int = 1800
    # Optional JSON file (defaultAction + egress rules) passed as networkPolicy on create.
    # Requires OpenSandbox [egress] + docker network_mode=bridge on the server.
    sandbox_network_policy_path: str = ""
    # Set to true only when OpenSandbox is configured with network_mode=bridge.
    # When false, networkPolicy is never sent (required for network_mode=opensandbox-sandbox).
    enable_network_policy: bool = False
    # Comma-separated browser origins allowed to call the API (e.g. https://app.example.com).
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Optional — legacy POST /api/spawn (Claude Code task sandboxes) only.
    anthropic_auth_token: str = ""
    # Injected into every vscode sandbox as ANTHROPIC_BASE_URL (e.g. http://api.example.com/api/llmgw).
    sandbox_anthropic_base_url: str = ""
    # Auth
    secret_key: str = "change-me-in-production"
    admin_email: str = "admin@example.com"
    admin_password: str = "changeme"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
