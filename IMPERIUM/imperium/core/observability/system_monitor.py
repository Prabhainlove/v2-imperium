from __future__ import annotations

from dataclasses import dataclass
from threading import Event, Thread
from time import sleep
from typing import Callable


@dataclass(slots=True)
class MonitorProbe:
    name: str
    callback: Callable[[], float]


class SystemMonitor:
    def __init__(self, *, interval_seconds: float = 5.0) -> None:
        self.interval_seconds = max(0.5, float(interval_seconds))
        self._probes: dict[str, MonitorProbe] = {}
        self._stop = Event()
        self._thread: Thread | None = None
        self._sink: Callable[[str, float], None] | None = None

    def register_probe(self, name: str, callback: Callable[[], float]) -> None:
        self._probes[name] = MonitorProbe(name=name, callback=callback)

    def set_sink(self, sink: Callable[[str, float], None]) -> None:
        self._sink = sink

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return

        self._stop.clear()
        self._thread = Thread(target=self._loop, daemon=True)
        self._thread.start()

    def shutdown(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=1.0)

    def _loop(self) -> None:
        while not self._stop.is_set():
            for probe in list(self._probes.values()):
                try:
                    value = float(probe.callback())
                except Exception:
                    continue

                if self._sink is not None:
                    self._sink(probe.name, value)

            sleep(self.interval_seconds)
