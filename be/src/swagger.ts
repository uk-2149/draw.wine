import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "draw.wine API",
      version: "1.0.0",
      description: "REST API documentation for the draw.wine backend services",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development Server",
      },
      {
        url: "https://api.draw-wine.rudrax.me",
        description: "Production Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Enter your Solana wallet JWT token to access protected endpoints.",
        },
      },
    },
  },
  // Automatically extract documentation from these files
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
