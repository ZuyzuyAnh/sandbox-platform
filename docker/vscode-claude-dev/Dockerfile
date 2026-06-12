FROM opensandbox/vscode-claude:latest

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv \
        golang \
        build-essential make \
    && rm -rf /var/lib/apt/lists/*

USER vscode

WORKDIR /workspace
