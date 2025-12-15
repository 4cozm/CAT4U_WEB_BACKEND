import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: 'mysql://root:rootpass@127.0.0.1:3306/default',
    },
});
