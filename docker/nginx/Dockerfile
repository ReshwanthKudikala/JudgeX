FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80 443
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/nginx-health || exit 1
CMD ["nginx", "-g", "daemon off;"]
