from setuptools import find_packages, setup

setup(
    name="pyshared",
    version="0.2.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.110",
        "starlette>=0.37",
        "httpx>=0.27",
        "PyJWT>=2.8",
        "cryptography>=42",
        "boto3>=1.34",
        "sqlalchemy>=2.0",
    ],
)
