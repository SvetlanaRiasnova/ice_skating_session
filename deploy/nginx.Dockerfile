FROM node:22.16.0-alpine as build_static

ENV PROJECT_DIR /project
ENV SRC_DIR ./src/

COPY $SRC_DIR $PROJECT_DIR
WORKDIR $PROJECT_DIR
COPY ./deploy/nginx.conf $PROJECT_DIR

ARG API_ENDPOINT
RUN touch ./.env && echo "VITE_API_BASE_URL=$API_ENDPOINT" > .env

RUN npm install
RUN npm run build

FROM nginx:latest
COPY --from=build_static /project/nginx.conf /etc/nginx
COPY --from=build_static /project/dist /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
