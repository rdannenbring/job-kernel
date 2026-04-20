FROM python:3.11-slim

WORKDIR /app

# Install system dependencies:
#   build-essential + libpq-dev  — for psycopg2 compilation
#   libreoffice                  — for native DOCX → PDF conversion
#   curl                         — for the Docker healthcheck
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libreoffice \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user and the /data volume mount point
RUN useradd -m -u 1001 appuser \
    && mkdir -p /data/uploads /data/outputs \
    && chown -R appuser:appuser /data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
