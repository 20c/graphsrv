
from setuptools import setup

setup(
    name='graphsrv',
    version='0.1',
    author='Twentieth Century',
    author_email='code@20c.com',
    description='serve embeddable graphs',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: Apache Software License',
        'Topic :: Software Development :: Libraries :: Python Modules',
    ],
    packages=[
      'graphsrv'
    ],
    install_requires=open("facsimile/requirements.txt").read().split("\n"),
    include_package_data=True,
    zip_safe=False
)
