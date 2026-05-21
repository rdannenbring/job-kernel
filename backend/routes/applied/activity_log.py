"""GET ``/api/applications/{application_id}/applied/activity-log``.

Owner task: T12. Body added by that task. Until then this module is a
silent no-op; no route is registered so requests return 404, which is
correct for "endpoint not yet implemented".
"""
from . import router  # noqa: F401 -- keep package import side-effects alive
