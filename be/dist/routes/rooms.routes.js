"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rooms_controller_1 = require("../controllers/rooms.controller");
const roomRouter = (0, express_1.Router)();
roomRouter.post("/", rooms_controller_1.CreateRoom);
roomRouter.get('/:roomId', rooms_controller_1.getRoomInfo);
exports.default = roomRouter;
