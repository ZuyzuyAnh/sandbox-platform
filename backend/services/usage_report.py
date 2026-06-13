"""
Render a PowerBI-style dark-theme usage report to PNG using matplotlib (Agg).
Called via asyncio.to_thread — matplotlib is synchronous.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from io import BytesIO

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.gridspec import GridSpec
from matplotlib.patches import FancyBboxPatch, Rectangle

# ── Palette (matches the web UI dark theme) ───────────────────────────────────
DARK_BG  = "#0d1117"   # page background
SURFACE  = "#161b22"   # card background
BORDER   = "#30363d"   # card border
TEXT     = "#f0f6fc"   # primary text
MUTED    = "#8b949e"   # secondary text
ACCENT   = "#f97316"   # orange
BLUE     = "#3b82f6"
GREEN    = "#22c55e"
PURPLE   = "#a855f7"
SERIES   = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#06b6d4", "#f59e0b", "#ef4444"]
GRID_CLR = "#21262d"


def _fmt(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}K"
    return f"{n:,}"


def _style_chart(ax, grid_axis: str = "y") -> None:
    """Apply dark-theme styling to a chart axes."""
    ax.set_facecolor(SURFACE)
    for spine in ax.spines.values():
        spine.set_edgecolor(BORDER)
        spine.set_linewidth(0.8)
    ax.tick_params(colors=MUTED, labelsize=8, length=0)
    ax.set_axisbelow(True)
    ax.grid(axis=grid_axis, color=GRID_CLR, linewidth=0.7, linestyle="--", alpha=0.8)


def _kpi_card(fig, ax, title: str, value: str, subtitle: str, color: str) -> None:
    """Draw a PowerBI-style KPI metric card."""
    ax.set_facecolor(SURFACE)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_edgecolor(BORDER)
        spine.set_linewidth(0.8)

    # Colored top accent bar
    ax.add_patch(Rectangle((0, 0.91), 1, 0.09,
                            transform=ax.transAxes,
                            color=color, clip_on=False, zorder=5))

    # Large value
    ax.text(0.5, 0.60, value,
            ha="center", va="center",
            fontsize=24, fontweight="bold", color=TEXT,
            transform=ax.transAxes)

    # Label
    ax.text(0.5, 0.31, title.upper(),
            ha="center", va="center",
            fontsize=7.5, color=MUTED, fontfamily="monospace",
            transform=ax.transAxes)

    # Subtitle
    if subtitle:
        ax.text(0.5, 0.12, subtitle,
                ha="center", va="center",
                fontsize=7, color=color, alpha=0.9,
                transform=ax.transAxes)


def render_usage_report(
    rows: list[dict],
    key_labels: dict[str, str],
    days: int,
) -> bytes:
    now   = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    # ── Aggregate ─────────────────────────────────────────────────────────────
    daily_in:  dict[str, int] = defaultdict(int)
    daily_out: dict[str, int] = defaultdict(int)
    by_model:  dict[str, int] = defaultdict(int)
    by_key:    dict[str, int] = defaultdict(int)
    total_input = total_output = 0

    for r in rows:
        day = r["created_at"].strftime("%m-%d")
        daily_in[day]  += r["input_tokens"]
        daily_out[day] += r["output_tokens"]
        by_model[r["model"]] += r["input_tokens"] + r["output_tokens"]
        by_key[r["virtual_key_id"]] += r["input_tokens"] + r["output_tokens"]
        total_input  += r["input_tokens"]
        total_output += r["output_tokens"]

    total_tokens = total_input + total_output
    day_keys = [(start + timedelta(days=i)).strftime("%m-%d") for i in range(days + 1)]

    # ── Figure & GridSpec ─────────────────────────────────────────────────────
    fig = plt.figure(figsize=(16, 11), dpi=140, facecolor=DARK_BG)
    gs = GridSpec(
        3, 4,
        figure=fig,
        height_ratios=[1.0, 3.8, 3.0],
        hspace=0.55,
        wspace=0.38,
        left=0.06, right=0.97, top=0.90, bottom=0.06,
    )

    # ── Title ─────────────────────────────────────────────────────────────────
    fig.text(0.5, 0.965,
             "LLM Gateway  ·  Token Usage Report",
             ha="center", fontsize=15, fontweight="bold", color=TEXT)
    fig.text(0.5, 0.940,
             f"{start.strftime('%b %d, %Y')}  →  {now.strftime('%b %d, %Y')}   ·   {len(rows):,} requests",
             ha="center", fontsize=9, color=MUTED)

    # Thin separator line under title
    fig.add_artist(plt.Line2D([0.06, 0.97], [0.928, 0.928],
                               transform=fig.transFigure,
                               color=BORDER, linewidth=0.8))

    # ── KPI Cards (row 0) ─────────────────────────────────────────────────────
    pct_in  = f"{total_input  / total_tokens * 100:.1f}% of total" if total_tokens else "—"
    pct_out = f"{total_output / total_tokens * 100:.1f}% of total" if total_tokens else "—"
    kpis = [
        ("Total Tokens",  _fmt(total_tokens),  f"Last {days} days",          ACCENT),
        ("Input Tokens",  _fmt(total_input),   pct_in,                       BLUE),
        ("Output Tokens", _fmt(total_output),  pct_out,                      GREEN),
        ("Requests",      f"{len(rows):,}",    f"{len(by_model)} model(s)",  PURPLE),
    ]
    for col, (title, value, sub, color) in enumerate(kpis):
        ax = fig.add_subplot(gs[0, col])
        _kpi_card(fig, ax, title, value, sub, color)

    # ── Daily stacked bar (row 1, cols 0-2) ───────────────────────────────────
    ax_d = fig.add_subplot(gs[1, :3])
    _style_chart(ax_d, grid_axis="y")
    in_vals  = [daily_in.get(d, 0)  for d in day_keys]
    out_vals = [daily_out.get(d, 0) for d in day_keys]
    x = range(len(day_keys))
    ax_d.bar(x, in_vals,  label="Input",  color=BLUE,   width=0.72, alpha=0.88)
    ax_d.bar(x, out_vals, label="Output", color=ACCENT, width=0.72, alpha=0.92,
             bottom=in_vals)
    step = max(1, len(day_keys) // 14)
    ax_d.set_xticks(list(x))
    ax_d.set_xticklabels(
        [d if i % step == 0 else "" for i, d in enumerate(day_keys)],
        fontsize=7.5, color=MUTED, rotation=0,
    )
    ax_d.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: _fmt(int(v))))
    ax_d.set_title("Daily Token Usage", loc="left", fontsize=10,
                   fontweight="bold", color=TEXT, pad=10)
    legend = ax_d.legend(frameon=False, fontsize=8, labelcolor=MUTED,
                          loc="upper left", ncol=2)

    # ── Donut: Input vs Output (row 1, col 3) ─────────────────────────────────
    ax_pie = fig.add_subplot(gs[1, 3])
    ax_pie.set_facecolor(SURFACE)
    for spine in ax_pie.spines.values():
        spine.set_edgecolor(BORDER)
        spine.set_linewidth(0.8)
    ax_pie.set_xticks([])
    ax_pie.set_yticks([])
    ax_pie.set_title("Input vs Output", fontsize=10,
                     fontweight="bold", color=TEXT, pad=10)

    if total_tokens > 0:
        wedges, _ = ax_pie.pie(
            [total_input, total_output],
            colors=[BLUE, ACCENT],
            startangle=90,
            counterclock=False,
            wedgeprops={"width": 0.52, "edgecolor": SURFACE, "linewidth": 2.5},
        )
        # Center text
        ax_pie.text(0, 0.10, _fmt(total_tokens),
                    ha="center", va="center", fontsize=14,
                    fontweight="bold", color=TEXT)
        ax_pie.text(0, -0.18, "total tokens",
                    ha="center", va="center", fontsize=7, color=MUTED)
        # Mini legend
        for yi, (label, color, val) in enumerate([("Input", BLUE, total_input),
                                                   ("Output", ACCENT, total_output)]):
            pct = val / total_tokens * 100
            ax_pie.text(-0.95, -0.62 + yi * 0.22, "●",
                        ha="left", va="center", fontsize=10, color=color)
            ax_pie.text(-0.75, -0.62 + yi * 0.22,
                        f"{label}  {_fmt(val)}  ({pct:.1f}%)",
                        ha="left", va="center", fontsize=7.5, color=MUTED)
        ax_pie.set_xlim(-1.1, 1.1)
        ax_pie.set_ylim(-0.85, 1.05)
    else:
        ax_pie.text(0, 0, "No data", ha="center", va="center",
                    fontsize=9, color=MUTED)
        ax_pie.set_xlim(-1, 1)
        ax_pie.set_ylim(-1, 1)

    # ── Tokens by model (row 2, cols 0-1) ────────────────────────────────────
    ax_m = fig.add_subplot(gs[2, :2])
    _style_chart(ax_m, grid_axis="x")
    models_sorted = sorted(by_model.items(), key=lambda kv: kv[1], reverse=True)[:6]
    ax_m.set_title("Tokens by Model", loc="left", fontsize=10,
                   fontweight="bold", color=TEXT, pad=10)
    if models_sorted:
        names_m = [m for m, _ in models_sorted]
        vals_m  = [v for _, v in models_sorted]
        ax_m.barh(range(len(names_m)), vals_m,
                  color=SERIES[:len(names_m)], height=0.52, alpha=0.90)
        ax_m.set_yticks(range(len(names_m)))
        ax_m.set_yticklabels(names_m, fontsize=8, color=MUTED, fontfamily="monospace")
        ax_m.set_ylim(-0.6, max(len(names_m), 4) - 0.4)
        ax_m.invert_yaxis()
        ax_m.xaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: _fmt(int(v))))
        for i, v in enumerate(vals_m):
            ax_m.text(v, i, f"  {_fmt(v)}", va="center", fontsize=7.5, color=MUTED)
    else:
        ax_m.text(0.5, 0.5, "No data", ha="center", va="center",
                  color=MUTED, transform=ax_m.transAxes)

    # ── Top API keys (row 2, cols 2-3) ───────────────────────────────────────
    ax_k = fig.add_subplot(gs[2, 2:])
    _style_chart(ax_k, grid_axis="x")
    keys_sorted = sorted(by_key.items(), key=lambda kv: kv[1], reverse=True)[:6]
    ax_k.set_title("Top API Keys", loc="left", fontsize=10,
                   fontweight="bold", color=TEXT, pad=10)
    if keys_sorted:
        names_k = [key_labels.get(k, k[:14]) for k, _ in keys_sorted]
        vals_k  = [v for _, v in keys_sorted]
        bars = ax_k.barh(range(len(names_k)), vals_k,
                          color=ACCENT, height=0.52, alpha=0.85)
        # Gradient effect: fade later bars slightly
        for i, bar in enumerate(bars):
            bar.set_alpha(0.90 - i * 0.06)
        ax_k.set_yticks(range(len(names_k)))
        ax_k.set_yticklabels(names_k, fontsize=8, color=MUTED, fontfamily="monospace")
        ax_k.set_ylim(-0.6, max(len(names_k), 4) - 0.4)
        ax_k.invert_yaxis()
        ax_k.xaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: _fmt(int(v))))
        for i, v in enumerate(vals_k):
            ax_k.text(v, i, f"  {_fmt(v)}", va="center", fontsize=7.5, color=MUTED)
    else:
        ax_k.text(0.5, 0.5, "No data", ha="center", va="center",
                  color=MUTED, transform=ax_k.transAxes)

    # ── Footer ────────────────────────────────────────────────────────────────
    fig.text(0.5, 0.01,
             f"Generated {now.strftime('%Y-%m-%d %H:%M')} UTC  ·  LLM Gateway Dashboard",
             ha="center", fontsize=7, color=BORDER)

    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight",
                facecolor=fig.get_facecolor(), dpi=140)
    plt.close(fig)
    return buf.getvalue()
