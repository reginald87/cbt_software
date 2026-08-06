from pathlib import Path
import os
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-s^j6vfedmuud=bnswpt$%bn#3+%nkc30+$0vjppa&1ieawstr7')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')


INSTALLED_APPS = [
    'jazzmin',  # Must be first to override admin templates
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'crispy_forms',
    'crispy_bootstrap5',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    
    # Local apps
    'users.apps.UsersConfig',
    'exams.apps.ExamsConfig',
    'results.apps.ResultsConfig',
    'utils.apps.UtilsConfig',
]

# 2. Ensure MIDDLEWARE is correct for Django 6:
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
        'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# 3. For Django 6, the default auto field is already BigAutoField, but ensure:
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

ROOT_URLCONF = 'bmu_cbt.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'bmu_cbt.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password hashers
# https://docs.djangoproject.com/en/6.0/ref/settings/#password-hashers
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'users.hashers.TemporaryPasswordHasher',
]


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'
TIME_ZONE = config('TIME_ZONE', default='Africa/Lagos')
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Crispy Forms
CRISPY_ALLOWED_TEMPLATE_PACKS = "bootstrap5"
CRISPY_TEMPLATE_PACK = "bootstrap5"

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# Login/Logout URLs
LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/dashboard/'
LOGOUT_REDIRECT_URL = '/'

# Session settings
SESSION_COOKIE_AGE = 86400  # 24 hours in seconds
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# BMU Custom Configuration
BMU_CONFIG = {
    # Identifier Patterns
    'MATRIC_PATTERN': r'^UG/\d{2}/\d{4}$',
    'JAMB_PATTERN': r'^\d{12,13}[A-Z]{2}$',
    
    # Authentication
    'USERNAME_PREFIX': 'BMU-',
    'USERNAME_LENGTH': 4,
    'PASSWORD_LENGTH': 8,
    
    # Exam Settings
    'DEFAULT_EXAM_DURATION': 60,
    'QUESTIONS_PER_PAGE': 5,
    'AUTO_SAVE_INTERVAL': 30,
    'SHOW_TIMER_WARNINGS': [30, 10, 5],
    
    # Security
    'ALLOW_IP_SESSION_LOCK': True,
    'ALLOW_TAB_SWITCH_DETECTION': True,
    'ENABLE_AUTO_SUBMIT': True,
    'MAX_LOGIN_ATTEMPTS': 3,
    
    # Grading
    'GRADING_SCALE': {
        'A': 70, 'B': 60, 'C': 50, 'D': 45, 'E': 40, 'F': 0,
    },
    
    # Institution
    'INSTITUTION_NAME': 'Bayelsa Medical University',
    'INSTITUTION_SHORT_NAME': 'BMU',
    'SUPPORT_EMAIL': 'exams@bmu.edu.ng',
    'SUPPORT_PHONE': '+234 XXX XXX XXXX',
}

# Django Jazzmin Configuration
JAZZMIN_SETTINGS = {
    "site_title": "BMU CBT Admin",
    "site_header": "Bayelsa Medical University - CBT System",
    "site_brand": "BMU CBT",
    "welcome_sign": "Welcome to BMU CBT Administration",
    "copyright": "Bayelsa Medical University © 2026",
    
    # Icons
    "search_model": ["users.User"],
    "order_with_respect_to": ["users", "exams", "results"],
    
    # Sidebar
    "show_sidebar": True,
    "navigation_expanded": True,
    
    # Custom links
    "userswitcher_enabled": True,
    "show_ui_builder": False,
    
    "navigation": [
        {
            "app": "users",
            "icon": "fas fa-users",
            "name": "User Management"
        },
        {
            "app": "exams",
            "icon": "fas fa-clipboard-list",
            "name": "Exams"
        },
        {
            "app": "results",
            "icon": "fas fa-chart-bar",
            "name": "Results & Analytics"
        },
    ]
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small": False,
    "footer_small": False,
    "body_small": False,
    "brand_small": False,
    "brand_colour": "navbar-info",
    "accent": "accent-primary",
    "tooltip_class": "rounded-lg",
    "navbar_padfloat": False,
    "navbar_breakpoint": 3000,
    "actions_sticky_top": False
}

from datetime import timedelta

# Django REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8000').split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'cache-control',
    'content-type',
    'dnt',
    'origin',
    'pragma',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
