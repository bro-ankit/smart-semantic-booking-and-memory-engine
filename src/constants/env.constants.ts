export const ENV_VARIABLES = {
    DATABASE: {
        host: "DB.HOST",
        port: "DB.PORT",
        user: "DB.USER",
        password: "DB.PASSWORD",
        database: "DB.NAME",
        poolSize: "DB.POOL_SIZE",
    },
    GEMINI: {
        API_KEY: "GEMINI.API_KEY"
    },
    SERVER: {
        PORT: 'SERVER.PORT'
    }
} as const