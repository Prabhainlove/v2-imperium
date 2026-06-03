from __future__ import annotations

import asyncio
import inspect
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from core.common import BusMessage

MessageHandler = Callable[[BusMessage], None]
DispatchFailureHook = Callable[[BusMessage, Exception], None]


class EventDispatcher:
    def __init__(
        self,
        *,
        max_workers: int = 8,
        failure_hook: DispatchFailureHook | None = None,
    ) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._failure_hook = failure_hook

    def dispatch(self, message: BusMessage, handlers: list[MessageHandler]) -> None:
        for handler in handlers:
            self._executor.submit(self._invoke_handler, message, handler)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)

    def _invoke_handler(self, message: BusMessage, handler: MessageHandler) -> None:
        try:
            result = handler(message)
            if inspect.isawaitable(result):
                asyncio.run(result)
        except Exception as exc:
            if self._failure_hook is not None:
                self._failure_hook(message, exc)
