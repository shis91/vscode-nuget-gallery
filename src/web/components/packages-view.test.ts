import '../web-setup';
import * as assert from 'assert';
import { PackagesView } from '@/web/components/packages-view';
import { PackageViewModel } from '@/web/types';
import { DOM } from '@microsoft/fast-element';
import { GET_PACKAGES, GET_PROJECTS } from '@/common/messaging/core/commands';
import { DI, Registration } from '@microsoft/fast-foundation';
import { Configuration } from '@/web/registrations';

suite('PackagesView Component', () => {
    let packagesView: PackagesView;
    let mockMediator: any;
    let publishAsyncStub: any;

    setup(() => {
        // Mock getComputedStyle for Split.js
        window.getComputedStyle = () => ({
            flexDirection: 'row',
            // Add other properties if needed
        } as any);

        // Register Configuration for DI (used by SearchBar)
        // We register it on the DOM container which SearchBar will use
        const container = DI.getOrCreateDOMContainer();

        // Check if already registered to avoid duplicates if possible, or just overwrite/register
        // Since it's a test setup, we can register.
        container.register(
            Registration.instance(Configuration, {
                Configuration: {
                    Sources: []
                }
            } as any)
        );

        // Mock IMediator
        publishAsyncStub = (command: string, request: any) => {
            if (command === GET_PROJECTS) {
                return Promise.resolve({ Projects: [] });
            }
            if (command === GET_PACKAGES) {
                return Promise.resolve({ Packages: [] });
            }
            return Promise.resolve({});
        };

        mockMediator = {
            PublishAsync: (command: string, request: any) => publishAsyncStub(command, request)
        };

        // Create instance
        packagesView = new PackagesView();

        // Inject configuration (needed for PackagesView itself too)
        Object.defineProperty(packagesView, 'configuration', {
            value: {
                Configuration: {
                    Sources: []
                }
            },
            writable: true
        });

        // Inject mock mediator
        Object.defineProperty(packagesView, 'mediator', {
            value: mockMediator,
            writable: true
        });

        document.body.appendChild(packagesView);
    });

    teardown(() => {
        if (packagesView && packagesView.parentNode) {
            document.body.removeChild(packagesView);
        }
    });

    test('should identify vulnerable packages', async () => {
        const vulnerablePkg = new PackageViewModel({
            Id: 'Vulnerable',
            Name: 'Vulnerable',
            Version: '1.0.0',
            Versions: [],
            Authors: [],
            Description: '',
            IconUrl: '',
            LicenseUrl: '',
            ProjectUrl: '',
            Registration: '',
            Tags: [],
            TotalDownloads: 0,
            Verified: false,
            InstalledVersion: '1.0.0',
            Vulnerabilities: [{ Severity: 2, AdvisoryUrl: 'http://advisory' }]
        });

        const safePkg = new PackageViewModel({
            Id: 'Safe',
            Name: 'Safe',
            Version: '1.0.0',
            Versions: [],
            Authors: [],
            Description: '',
            IconUrl: '',
            LicenseUrl: '',
            ProjectUrl: '',
            Registration: '',
            Tags: [],
            TotalDownloads: 0,
            Verified: false,
            InstalledVersion: '1.0.0',
            Vulnerabilities: []
        });

        packagesView.projectsPackages = [vulnerablePkg, safePkg];

        // Trigger update if needed (vulnerablePackages is a getter, so it should be immediate)
        const vulnerable = packagesView.vulnerablePackages;

        assert.strictEqual(vulnerable.length, 1);
        assert.strictEqual(vulnerable[0].Id, 'Vulnerable');
    });

    test('should render VULNERABLE tab', async () => {
        await DOM.nextUpdate();
        const shadowRoot = packagesView.shadowRoot;
        const tabs = shadowRoot?.querySelectorAll('vscode-panel-tab');

        let found = false;
        tabs?.forEach(tab => {
            if (tab.textContent?.trim() === 'VULNERABLE') {
                found = true;
            }
        });

        assert.ok(found, 'VULNERABLE tab not found');
    });
});
