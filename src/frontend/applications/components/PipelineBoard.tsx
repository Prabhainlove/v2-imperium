import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useApplicationsStore, selectPipelineBuckets } from "../state/useApplicationsStore";
import { PIPELINE_COLUMNS, STATUS_LABEL, type Application, type ApplicationStatus } from "../schema";
import { CompanyAvatar } from "./CompanyAvatar";

function Card({ app }: { app: Application }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;
  const select = useApplicationsStore((s) => s.selectApplication);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="pipeline-card"
      {...attributes}
      {...listeners}
      onClick={() => select(app.id)}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <CompanyAvatar company={app.company} size={22} />
        <div style={{ minWidth: 0 }}>
          <div className="company" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {app.company}
          </div>
          <div className="role" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {app.role}
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({ status, apps }: { status: ApplicationStatus; apps: Application[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`pipeline-col ${isOver ? "drag-over" : ""}`}>
      <div className="pipeline-col-header">
        <span>{STATUS_LABEL[status]}</span>
        <span className="pipeline-col-count">{apps.length}</span>
      </div>
      {apps.map((a) => <Card key={a.id} app={a} />)}
    </div>
  );
}

export function PipelineBoard() {
  const apps = useApplicationsStore((s) => s.applications);
  const updateStatus = useApplicationsStore((s) => s.updateStatus);
  const buckets = useMemo(() => selectPipelineBuckets(apps), [apps]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [, setTick] = useState(0);
  const onDragEnd = (e: DragEndEvent) => {
    const id = e.active.id as string;
    const target = e.over?.id as ApplicationStatus | undefined;
    if (!target) return;
    updateStatus(id, target);
    setTick((t) => t + 1);
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="pipeline">
        {PIPELINE_COLUMNS.map((s) => (
          <Column key={s} status={s} apps={buckets[s]} />
        ))}
      </div>
    </DndContext>
  );
}
