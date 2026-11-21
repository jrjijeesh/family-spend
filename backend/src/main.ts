import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: process.env.ALLOWED_ORIGINS?.split(",") ?? false });
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Reject unexpected payloads
      transform: true,
    }),
  );

  // Auto-generated OpenAPI spec at /docs
  const config = new DocumentBuilder()
    .setTitle("Family Spend Enterprise API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, doc);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
