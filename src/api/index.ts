import dotenv from 'dotenv';
import app from './app';
import prisma from '../Db';

dotenv.config(
    {
        path: process.env.NODE_ENV === "test" ? ".env.test" : ".env"
    }
);

const server = app.listen(5000, () => {
    console.log(`Server started on http://localhost:5000`);
    console.log(process.env.DATABASE_URL);
})

process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await prisma.$disconnect();
    server.close(() => {
        console.log("Server closed.");
        process.exit(0);

    });
});