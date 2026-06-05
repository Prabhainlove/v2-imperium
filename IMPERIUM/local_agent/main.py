"""
main.py — entrypoint shim.

Kept so the documented ``python main.py`` command still works after the
refactor. All real logic lives in ``api/agent_server.py``.

Layout (see README.md for the diagram):

    local_agent/
    ├── main.py              <- you are here (3-line shim)
    ├── api/agent_server.py  <- HTTP server
    ├── agents/              <- run orchestrator(s)
    ├── automation/          <- Selenium + form mechanics
    ├── shared/              <- state + Ollama LLM client
    └── storage/             <- application_history.json (persisted runs)
"""
import os
import sys

# Make absolute imports work when run as `python main.py` from any CWD.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.agent_server import main  # noqa: E402

if __name__ == "__main__":
    main()
