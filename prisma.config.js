//prisma 관련 설정 신 버전 부터는 이 방식 사용해야함

import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: "mysql://root:rootpass@127.0.0.1:3306/default",
    },
});
