import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"



const app = express()

app.use(cookieParser())

app.use(cors({
    origin: true,
    credentials: true,
}))

app.get("/", (req, res) => {
    res.status(200).send("Hello, Server is running")
}
)

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});






app.use(express.json())
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(express.static("public"))

// Router import
import routes from "./routers/route"
// import gymRouter from "./routers/gym.router"
// import facilitiesRouter from "./routers/Facilities.router"
// import planRouter from "./routers/plan.router"
// import reviewRouter from "./routers/review.router"
// import trainerRouter from "./routers/trainer.router"
// import gymTimeRouter from "./routers/gymTime.router"
// import bookingRouter from "./routers/booking.router"
// import inquiryRouter from "./routers/inquiry.router"

app.use("/api/v1", routes)
// app.use("/api/v1/gym", gymRouter)
// app.use("/api/v1/facilities", facilitiesRouter)
// app.use("/api/v1/plans", planRouter)
// app.use("/api/v1/reviews", reviewRouter)
// app.use("/api/v1/trainers", trainerRouter)
// app.use("/api/v1/gym-time", gymTimeRouter)
// app.use("/api/v1/booking", bookingRouter)
// app.use("/api/v1/inquiry", inquiryRouter)





// Roueters
// app.use("/api/v1/user", userRouter)


export default app