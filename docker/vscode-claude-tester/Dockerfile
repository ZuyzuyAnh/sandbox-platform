FROM opensandbox/vscode-claude:latest

USER root

# k6 repo + system deps for Playwright
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip \
        gnupg \
        libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libgbm1 libasound2 \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://dl.k6.io/key.gpg | gpg --dearmor -o /etc/apt/keyrings/k6.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/k6.gpg] https://dl.k6.io/deb stable main" \
        > /etc/apt/sources.list.d/k6.list \
    && apt-get update && apt-get install -y --no-install-recommends k6 \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages pytest pytest-asyncio requests

RUN npm install -g newman playwright

RUN npx playwright install --with-deps chromium

USER vscode

WORKDIR /workspace
