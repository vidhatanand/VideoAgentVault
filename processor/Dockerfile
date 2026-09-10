FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 media
WORKDIR /app
COPY server.py media_progress.py audio_quality.py media_qa.py /app/
ARG PROCESSOR_RELEASE=local
ENV PROCESSOR_RELEASE=$PROCESSOR_RELEASE
USER 10001:10001
ENV PYTHONUNBUFFERED=1 PORT=8080
EXPOSE 8080
CMD ["python", "/app/server.py"]
