"""
Custom password hashers for BMU CBT.
"""

from django.contrib.auth.hashers import PBKDF2PasswordHasher


class TemporaryPasswordHasher(PBKDF2PasswordHasher):
    """
    Lower-cost PBKDF2 hasher used for bulk-created temporary student accounts.

    The default PBKDF2 hasher (1.2M iterations) takes ~0.9s per password,
    which makes importing hundreds of students extremely slow. Bulk-created
    accounts receive a temporary password that is printed and distributed,
    and students are forced to set a new password on first login. Once they
    change their password, the default strong hasher is used.

    Iterations are tuned so hashing stays fast while remaining a real
    (though reduced) PBKDF2 workload.
    """

    algorithm = "pbkdf2_sha256_temp"
    iterations = 50000
