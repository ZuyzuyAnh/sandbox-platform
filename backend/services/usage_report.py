"""
Render token-usage charts to a single PNG with matplotlib (Agg, no display).

Called from the llmgw router via asyncio.to_thread — matplotlib is synchronous.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from io import BytesIO

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ACCENT = "#f97316"
INK = "#1c1917"
MUTED = "#78716c"
GRID = "#e7e5e4"


def render_usage_report(
    rows: list[dict],
    key_labels: dict[str, str],
    days: int,
) -> bytes:
    """
    rows: [{created_at: datetime, model: str, virtual_key_id: str,
            input_tokens: int, output_tokens: int}]
    key_labels: virtual_key_id -> display label
    Returns PNG bytes (daily chart + by-model chart + top-keys chart).
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    daily_in: dict[str, int] = defaultdict(int)
    daily_out: dict[str, int] = defaultdict(int)
    by_model: dict[str, int] = defaultdict(int)
    by_key: dict[str, int] = defaultdict(int)

    for r in rows:
        day = r["created_at"].strftime("%m-%d")
        daily_in[day] += r["input_tokens"]
        daily_out[day] += r["output_tokens"]
        by_model[r["model"]] += r["input_tokens"] + r["output_tokens"]
        by_key[r["virtual_key_id"]] += r["input_tokens"] + r["output_tokens"]

    # Fill every day in range so the x-axis has no gaps
    day_keys = [(start + timedelta(days=i)).strftime("%m-%d") for i in range(days + 1)]

    fig, axes = plt.subplots(3, 1, figsize=(11, 12), dpi=140)
    fig.patch.set_facecolor("white")
    fig.suptitle(
        f"LLM Gateway — Token Usage Report\n"
        f"{start.strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')} ({len(rows)} requests)",
        fontsize=13, fontweight="bold", color=INK,
    )

    # ── 1. Daily input/output tokens ────────────────────────────────────────
    ax = axes[0]
    in_vals = [daily_in.get(d, 0) for d in day_keys]
    out_vals = [daily_out.get(d, 0) for d in day_keys]
    x = range(len(day_keys))
    ax.bar(x, in_vals, label="Input tokens", color=ACCENT, width=0.7)
    ax.bar(x, out_vals, bottom=in_vals, label="Output tokens", color=INK, width=0.7)
    ax.set_title("Daily tokens", loc="left", fontsize=11, color=INK)
    ax.set_xticks(list(x))
    step = max(1, len(day_keys) // 12)
    ax.set_xticklabels(
        [d if i % step == 0 else "" for i, d in enumerate(day_keys)],
        fontsize=8, color=MUTED,
    )
    ax.legend(frameon=False, fontsize=9)

    def _barh(ax, names: list[str], vals: list[int], color: str) -> None:
        """Horizontal bars with a fixed visual thickness — a single bar must
        not balloon to fill the whole panel."""
        ax.barh(range(len(names)), vals, color=color, height=0.5)
        ax.set_yticks(range(len(names)))
        ax.set_yticklabels(names, fontsize=8)
        # Always scale the axis as if there were >= 5 rows
        ax.set_ylim(-0.6, max(len(names), 5) - 0.4)
        ax.invert_yaxis()  # biggest on top
        for i, v in enumerate(vals):
            ax.text(v, i, f" {v:,}", va="center", fontsize=8, color=MUTED)

    # ── 2. Tokens by model ──────────────────────────────────────────────────
    ax = axes[1]
    models = sorted(by_model.items(), key=lambda kv: kv[1], reverse=True)[:8]
    if models:
        _barh(ax, [m for m, _ in models], [v for _, v in models], ACCENT)
    else:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", color=MUTED)
    ax.set_title("Tokens by model", loc="left", fontsize=11, color=INK)

    # ── 3. Top keys ─────────────────────────────────────────────────────────
    ax = axes[2]
    keys = sorted(by_key.items(), key=lambda kv: kv[1], reverse=True)[:8]
    if keys:
        _barh(ax, [key_labels.get(k, k[:12]) for k, _ in keys], [v for _, v in keys], INK)
    else:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", color=MUTED)
    ax.set_title("Top API keys", loc="left", fontsize=11, color=INK)

    for ax in axes:
        ax.spines[["top", "right"]].set_visible(False)
        ax.spines[["left", "bottom"]].set_color(GRID)
        ax.tick_params(colors=MUTED, labelsize=8)
        ax.grid(axis="x" if ax is not axes[0] else "y", color=GRID, linewidth=0.6, alpha=0.6)
        ax.set_axisbelow(True)

    fig.tight_layout(rect=(0, 0, 1, 0.94))
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()
