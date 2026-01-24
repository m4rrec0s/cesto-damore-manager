# Estágio de construção
FROM node:20-alpine AS build

WORKDIR /app

# Copia arquivos de configuração de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante dos arquivos do projeto
COPY . .

# Executa o build da aplicação
# O Vite usará o arquivo .env para injetar as variáveis durante o build
RUN npm run build

# Estágio de produção usando Nginx para servir arquivos estáticos
FROM nginx:alpine

# Copia a configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos gerados no estágio anterior para o diretório do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expõe a porta 80 (padrão do Nginx)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
