import * as assert from 'assert';
import * as sinon from 'sinon';
import NuGetApi from '../../../../host/nuget/api';
import axios from 'axios';
import { Logger } from '../../../../common/logger';

suite('NuGetApi Tests', function () {
    let nugetApi: NuGetApi;
    let axiosCreateStub: sinon.SinonStub;
    let axiosInstanceStub: any;

    setup(() => {
        axiosInstanceStub = {
            get: sinon.stub(),
            interceptors: {
                request: {
                    use: sinon.stub()
                }
            }
        };
        axiosCreateStub = sinon.stub(axios, 'create').returns(axiosInstanceStub);

        // Stub Logger to avoid console spam during tests
        sinon.stub(Logger, 'debug');
        sinon.stub(Logger, 'info');
        sinon.stub(Logger, 'warn');
        sinon.stub(Logger, 'error');

        nugetApi = new NuGetApi('https://api.nuget.org/v3/index.json');
    });

    teardown(() => {
        sinon.restore();
    });

    test('should parse vulnerabilities from GetPackageAsync', async () => {
        const packageId = 'Vulnerable.Package';

        // Mock service index response
        axiosInstanceStub.get.withArgs('https://api.nuget.org/v3/index.json').resolves({
            data: {
                resources: [
                    { '@id': 'https://api.nuget.org/v3/query/', '@type': 'SearchQueryService' },
                    { '@id': 'https://api.nuget.org/v3/registration/', '@type': 'RegistrationsBaseUrl/3.6.0' }
                ]
            }
        });

        // Mock registration index response
        // Using sinon match for regex
        axiosInstanceStub.get.callsFake((url: string) => {
            if (url === 'https://api.nuget.org/v3/index.json') {
                return Promise.resolve({
                     data: {
                        resources: [
                            { '@id': 'https://api.nuget.org/v3/query/', '@type': 'SearchQueryService' },
                            { '@id': 'https://api.nuget.org/v3/registration/', '@type': 'RegistrationsBaseUrl/3.6.0' }
                        ]
                    }
                });
            }
            if (url.includes('registration/vulnerable.package/index.json')) {
                return Promise.resolve({
                    data: {
                        count: 1,
                        items: [
                            {
                                '@id': 'page1',
                                items: [
                                    {
                                        '@id': 'package_entry',
                                        catalogEntry: {
                                            id: packageId,
                                            version: '1.0.0',
                                            vulnerabilities: [
                                                {
                                                    severity: '2',
                                                    advisoryUrl: 'https://example.com/advisory'
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                });
            }
            return Promise.reject(new Error(`Unexpected URL: ${url}`));
        });

        const result = await nugetApi.GetPackageAsync(packageId);

        assert.strictEqual(result.isError, false);
        assert.ok(result.data);
        assert.strictEqual(result.data?.Vulnerabilities.length, 1);
        assert.strictEqual(result.data?.Vulnerabilities[0].Severity, 2);
        assert.strictEqual(result.data?.Vulnerabilities[0].AdvisoryUrl, 'https://example.com/advisory');
    });
});
