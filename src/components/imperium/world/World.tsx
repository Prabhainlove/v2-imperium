import { RoomIntro } from "./rooms/RoomIntro";
import { RoomRooftop } from "./rooms/RoomRooftop";
import { RoomStudio } from "./rooms/RoomStudio";
import { RoomArena } from "./rooms/RoomArena";
import { RoomMemory } from "./rooms/RoomMemory";
import { RoomOutro } from "./rooms/RoomOutro";

interface WorldProps {
  isMobile: boolean;
}

export function World({ isMobile }: WorldProps) {
  return (
    <>
      <RoomIntro />
      <RoomRooftop />
      <RoomStudio />
      <RoomArena isMobile={isMobile} />
      <RoomMemory />
      <RoomOutro />
    </>
  );
}
