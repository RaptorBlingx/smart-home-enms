FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .

# Install system deps required by healthcheck (curl) and for pip to build wheels
RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl gcc libpq-dev \
	&& rm -rf /var/lib/apt/lists/* \
	&& pip install --no-cache-dir -r requirements.txt

COPY ./app /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]