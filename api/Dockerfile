FROM node:22-alpine
# Eski ikili .doc/.xls önizlemesi için: exceljs/mammoth bu formatı okuyamıyor,
# LibreOffice headless ile PDF'e çevirip öyle gösteriyoruz (bkz. eysConvertToPdf).
RUN apk add --no-cache libreoffice-writer libreoffice-calc font-noto
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
COPY templates ./templates
CMD ["npm","start"]
