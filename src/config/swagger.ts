import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SiGana API Documentation',
      version: '1.0.0',
      description: 'API Documentation for Sistem Gizi Bencana (SiGana)',
      contact: {
        name: 'SiGana Team',
        email: 'admin@sigana.id',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'RELAWAN', 'STAKEHOLDER'] },
            isVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Village: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', example: 'Desa Sukamaju' },
            districts: { type: 'string', example: 'Kecamatan Melati' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Posko: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Posko Mawar 01' },
            villageId: { type: 'integer' },
            latitude: { type: 'number', format: 'float', example: -6.2088 },
            longitude: { type: 'number', format: 'float', example: 106.8456 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Balita: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            namaAnak: { type: 'string', example: 'Ayu Lestari' },
            namaOrtu: { type: 'string', example: 'Siti Aminah' },
            tanggalLahir: { type: 'string', format: 'date', example: '2023-05-15' },
            jenisKelamin: { type: 'string', enum: ['L', 'P'] },
            villageId: { type: 'integer' },
            poskoId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Measurement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            balitaId: { type: 'string', format: 'uuid' },
            beratBadan: { type: 'number', example: 8.5 },
            tinggiBadan: { type: 'number', example: 75.0 },
            lingkarKepala: { type: 'number', example: 45.0 },
            lila: { type: 'number', example: 14.5 },
            posisiUkur: { type: 'string', enum: ['TERLENTANG', 'BERDIRI'] },
            status: { type: 'string', enum: ['HIJAU', 'KUNING', 'MERAH'] },
            recordedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.ts'], // Path to the API docs
};

export const openApiSpecification = swaggerJsdoc(options);
