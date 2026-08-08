"""
Custom password hashers for BMU CBT.
"""

from django.contrib.auth.hashers import PBKDF2PasswordHasher


class TemporaryPasswordHasher(PBKDF2PasswordHasher):
    """
    Lower-cost PBKDF2 hasher used for bulk-imported student accounts.

    The default PBKDF2 hasher (1.2M iterations) takes ~3.6s per password,
    which makes importing hundreds of students far too slow. Bulk-created
    accounts keep the password generated at import time, so this hasher is
    their permanent storage. Iterations are tuned to balance import speed
    against a real (though reduced) PBKDF2 workload; the bulk import hashes
    passwords in parallel, so a ~50k work factor keeps a full 800-student
    import to around half a minute.
    """

    algorithm = "pbkdf2_sha256_temp"
    iterations = 50000
