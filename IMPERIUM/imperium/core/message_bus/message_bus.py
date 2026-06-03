from __future__ import annotations

from dataclasses import asdict
from threading import Event, Thread
from typing import Any
from uuid import uuid4

from core.common import BusMessage, utc_now
from core.event_system import EventStream
from core.message_bus.event_dispatcher import EventDispatcher
from core.message_bus.message_queue import MessageQueue
from core.message_bus.topic_registry import MessageHandler, TopicRegistry


class MessageBus:
    def __init__(
        self,
        *,
        topic_registry: TopicRegistry | None = None,
        message_queue: MessageQueue | None = None,
        dispatcher: EventDispatcher | None = None,
        event_stream: EventStream | None = None,
        worker_count: int = 2,
    ) -> None:
        self.topic_registry = topic_registry or TopicRegistry()
        self.message_queue = message_queue or MessageQueue()
        self.event_dispatcher = dispatcher or EventDispatcher()
        self.event_stream = event_stream
        self.worker_count = max(1, worker_count)
        self._stop_event = Event()
        self._workers: list[Thread] = []

    def start(self) -> None:
        if self._workers:
            return

        self._stop_event.clear()
        for index in range(self.worker_count):
            worker = Thread(target=self._worker_loop, args=(index,), daemon=True)
            worker.start()
            self._workers.append(worker)

    def shutdown(self) -> None:
        self._stop_event.set()
        for worker in self._workers:
            worker.join(timeout=1.0)
        self._workers.clear()
        self.event_dispatcher.shutdown()

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        self.topic_registry.subscribe(topic, handler)

    def publish(
        self,
        topic: str,
        payload: dict[str, Any],
        *,
        sender: str = "system",
        correlation_id: str | None = None,
        priority: int = 5,
    ) -> str:
        normalized_topic = topic.strip().lower()
        if not normalized_topic:
            raise ValueError("topic cannot be empty")

        message = BusMessage(
            topic=normalized_topic,
            payload=dict(payload),
            sender=sender.strip() or "system",
            message_id=str(uuid4()),
            timestamp=utc_now(),
            correlation_id=correlation_id,
        )
        self.message_queue.enqueue(message, priority=priority)

        if self.event_stream is not None:
            self.event_stream.publish(
                event_type="system",
                name="message_published",
                payload={"message": asdict(message)},
                source="message_bus",
            )

        return message.message_id

    def broadcast(
        self,
        payload: dict[str, Any],
        *,
        sender: str = "system",
        priority: int = 5,
    ) -> list[str]:
        message_ids: list[str] = []
        topics = self.topic_registry.topics()
        if not topics:
            topics = ["broadcast"]

        for topic in topics:
            message_ids.append(
                self.publish(
                    topic=topic,
                    payload=payload,
                    sender=sender,
                    correlation_id=None,
                    priority=priority,
                )
            )
        return message_ids

    def _worker_loop(self, worker_index: int) -> None:
        while not self._stop_event.is_set():
            message = self.message_queue.dequeue(timeout=0.2)
            if message is None:
                continue

            handlers = self.topic_registry.get_handlers(message.topic)
            if handlers:
                self.event_dispatcher.dispatch(message, handlers)

            if self.event_stream is not None:
                self.event_stream.publish(
                    event_type="system",
                    name="message_dispatched",
                    payload={
                        "worker": worker_index,
                        "topic": message.topic,
                        "handler_count": len(handlers),
                        "message_id": message.message_id,
                    },
                    source="message_bus",
                )

            self.message_queue.task_done()
