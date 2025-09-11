import { Router } from "express";
import { CreateRoom, getRoomInfo } from "../controllers/rooms.controller";

const roomRouter = Router();

roomRouter.post("/", CreateRoom);
roomRouter.get('/:roomId', getRoomInfo);

export default roomRouter;