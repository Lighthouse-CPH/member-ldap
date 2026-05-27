FROM denoland/deno:2.3.3

WORKDIR /app

# Cache dependencies
COPY deno.json deno.lock* ./
RUN deno install --frozen

# Copy source
COPY src/ ./src/

# Pre-compile for faster startup
RUN deno cache --frozen src/main.ts

USER deno

EXPOSE 636 8080

CMD ["run", "--allow-net", "--allow-env", "--allow-read=/app/src", "src/main.ts"]
