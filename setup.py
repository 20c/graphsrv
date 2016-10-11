from setuptools import find_packages, setup

version = open('facsimile/VERSION').read().strip()
requirements = open('facsimile/requirements.txt').read().split("\n")
test_requirements = open('facsimile/requirements-test.txt').read().split("\n")

setup(
    name='graphsrv',
    version=version,
    author='Twentieth Century',
    author_email='code@20c.com',
    description='serve embeddable graphs',
    license='LICENSE.txt',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: Apache Software License',
    ],
    packages = find_packages(),
    include_package_data=True,
    url='https://github.com/20c/graphsrv',
    download_url='https://github.com/20c/graphsrv/%s' % version,
    install_requires=requirements,
    test_requires=test_requirements,
    zip_safe=False
)
