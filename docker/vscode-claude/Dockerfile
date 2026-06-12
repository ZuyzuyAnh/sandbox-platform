FROM sandbox-registry.cn-zhangjiakou.cr.aliyuncs.com/opensandbox/vscode:latest

USER root

# Base image has code-server only; Node/npm are required for Claude Code (Node 18+).
# Using NodeSource repo instead of Debian's default packages — avoids stale apt cache
# hash mismatches and ensures a current Node.js LTS version.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code@latest --quiet \
    && rm -rf /var/lib/apt/lists/*

RUN echo '#!/bin/bash\nexport ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}\nexec claude "$@"' \
    > /usr/local/bin/claude-auth && chmod +x /usr/local/bin/claude-auth

RUN chsh -s /bin/bash vscode

ENV TERM=xterm-256color

USER vscode

WORKDIR /workspace

# Auto-start code-server (base image CMD is just bash — must override)
CMD ["/bin/bash", "-c", "code-server --bind-addr 0.0.0.0:8443 --auth none /workspace"]
