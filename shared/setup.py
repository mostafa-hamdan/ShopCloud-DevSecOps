from setuptools import find_packages, setup

setup(
    name="pyshared",
    version="0.2.0",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.115.0",
        "starlette==0.38.6",
        "httpx==0.27.2",
        "PyJWT==2.9.0",
        "cryptography==43.0.1",
        "boto3==1.35.20",
        "botocore==1.35.20",
        "sqlalchemy==2.0.34",
    ],
)
