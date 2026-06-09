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

const VISIBLE_PER_COLUMN = 2;

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

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
      <div className="company">{app.company}</div>
      <div className="role">{app.role}</div>
      <div className="date">{fmtDate(app.appliedAt)}</div>
    </div>
  );
}

function Column({ status, apps }: { status: ApplicationStatus; apps: Application[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const visible = apps.slice(0, VISIBLE_PER_COLUMN);
  const rest = apps.length - visible.length;
  return (
    <div ref={setNodeRef} className={`pipeline-col ${isOver ? "drag-over" : ""}`} data-status={status}>
      <div className="pipeline-col-header">
        <span>{STATUS_LABEL[status]}</span>
        <span className="pipeline-col-count">{apps.length}</span>
      </div>
      <div className="pipeline-col-body">
        {visible.map((a) => <Card key={a.id} app={a} />)}
        {rest > 0 && <div className="pipeline-more">+ {rest} more</div>}
      </div>
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
