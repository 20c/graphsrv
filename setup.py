from setuptools import find_packages, setup

version = open('Ctl/VERSION').read().strip()
requirements = open('Ctl/requirements.txt').read().split("\n")
test_requirements = open('Ctl/requirements-test.txt').read().split("\n")

setup(
    name='graphsrv',
    version=version,
    author='Twentieth Century',
    author_email='code@20c.com',
    description='serve embeddable graphs',
    license='LICENSE.txt',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
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
