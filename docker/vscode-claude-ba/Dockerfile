FROM opensandbox/vscode-claude:latest

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages \
        pandas \
        jupyterlab \
        openpyxl \
        csvkit \
        matplotlib \
        seaborn

USER vscode

WORKDIR /workspace
