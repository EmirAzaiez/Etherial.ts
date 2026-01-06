/**
 * Swagger UI HTML Generator
 *
 * Generates a beautiful, customized Swagger UI page for API documentation
 */
/**
 * Get Swagger UI theme CSS
 */
function getThemeCSS(theme) {
    const themes = {
        dark: `
            body { background-color: #1a1a2e; }
            .swagger-ui { background-color: #1a1a2e; }
            .swagger-ui .topbar { background-color: #16213e; }
            .swagger-ui .info .title { color: #e94560; }
            .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info table { color: #eaeaea; }
            .swagger-ui .opblock-tag { color: #eaeaea; border-bottom: 1px solid #333; }
            .swagger-ui .opblock { background: #16213e; border-color: #333; }
            .swagger-ui .opblock-summary { border-color: #333; }
            .swagger-ui .opblock .opblock-summary-method { background: #e94560; }
            .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #61affe; }
            .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #49cc90; }
            .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #fca130; }
            .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #f93e3e; }
            .swagger-ui .opblock-summary-path { color: #eaeaea; }
            .swagger-ui .opblock-description-wrapper p { color: #ccc; }
            .swagger-ui table thead tr th { color: #eaeaea; }
            .swagger-ui table tbody tr td { color: #ccc; }
            .swagger-ui .parameter__name { color: #e94560; }
            .swagger-ui .parameter__type { color: #61affe; }
            .swagger-ui section.models { border-color: #333; }
            .swagger-ui section.models h4 { color: #eaeaea; }
            .swagger-ui .model-title { color: #e94560; }
            .swagger-ui .model { color: #ccc; }
            .swagger-ui .btn { background: #16213e; color: #eaeaea; border-color: #e94560; }
            .swagger-ui .btn:hover { background: #e94560; }
            .swagger-ui select { background: #16213e; color: #eaeaea; border-color: #333; }
            .swagger-ui input[type=text] { background: #16213e; color: #eaeaea; border-color: #333; }
            .swagger-ui .response-col_status { color: #49cc90; }
            .swagger-ui .tab li { color: #eaeaea; }
            .swagger-ui .tab li.active { color: #e94560; }
        `,
        monokai: `
            body { background-color: #272822; }
            .swagger-ui { background-color: #272822; }
            .swagger-ui .topbar { background-color: #1e1f1c; }
            .swagger-ui .info .title { color: #f92672; }
            .swagger-ui .info p, .swagger-ui .info li { color: #f8f8f2; }
            .swagger-ui .opblock-tag { color: #a6e22e; }
            .swagger-ui .opblock { background: #1e1f1c; border-color: #444; }
            .swagger-ui .opblock-summary-path { color: #e6db74; }
            .swagger-ui .parameter__name { color: #66d9ef; }
            .swagger-ui section.models h4 { color: #a6e22e; }
            .swagger-ui .model-title { color: #f92672; }
            .swagger-ui .model { color: #f8f8f2; }
        `,
        material: `
            .swagger-ui .topbar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
            .swagger-ui .info .title { color: #667eea; font-weight: 700; }
            .swagger-ui .opblock { border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .swagger-ui .opblock .opblock-summary-method { border-radius: 4px; }
            .swagger-ui .btn { border-radius: 4px; transition: all 0.2s; }
            .swagger-ui .btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
            .swagger-ui section.models { border-radius: 8px; }
        `,
        light: '',
        flattop: `
            .swagger-ui .topbar { display: none; }
            .swagger-ui .info { margin: 30px 0; }
        `,
        muted: `
            .swagger-ui .opblock.opblock-get { background: rgba(97, 175, 254, 0.05); }
            .swagger-ui .opblock.opblock-post { background: rgba(73, 204, 144, 0.05); }
            .swagger-ui .opblock.opblock-put { background: rgba(252, 161, 48, 0.05); }
            .swagger-ui .opblock.opblock-delete { background: rgba(249, 62, 62, 0.05); }
        `,
        newspaper: `
            body { font-family: 'Times New Roman', serif; }
            .swagger-ui { font-family: 'Times New Roman', serif; }
            .swagger-ui .info .title { font-family: 'Georgia', serif; font-style: italic; }
            .swagger-ui .opblock-tag { font-family: 'Georgia', serif; }
        `,
        outline: `
            .swagger-ui .opblock { background: transparent; border: 2px solid; }
            .swagger-ui .opblock.opblock-get { border-color: #61affe; }
            .swagger-ui .opblock.opblock-post { border-color: #49cc90; }
            .swagger-ui .opblock.opblock-put { border-color: #fca130; }
            .swagger-ui .opblock.opblock-delete { border-color: #f93e3e; }
        `,
    };
    return themes[theme] || '';
}
/**
 * Generate Swagger UI HTML page
 */
export function generateSwaggerUIHtml(config = {}) {
    const { title = 'API Documentation', specUrl = '/docs/openapi.json', spec, customCss = '', customJs = '', favicon = 'https://petstore.swagger.io/favicon-32x32.png', theme = 'material', } = config;
    const themeCSS = getThemeCSS(theme);
    const specScript = spec
        ? `spec: ${JSON.stringify(spec)},`
        : `url: "${specUrl}",`;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" type="image/png" href="${favicon}">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        html { box-sizing: border-box; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: #fafafa; }
        
        /* Etherial Custom Styles */
        .swagger-ui .topbar { 
            padding: 15px 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        }
        
        .swagger-ui .topbar .topbar-wrapper {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .swagger-ui .topbar .topbar-wrapper .link {
            display: flex;
            align-items: center;
        }
        
        .swagger-ui .topbar .topbar-wrapper .link img {
            height: 40px;
        }
        
        .swagger-ui .topbar .topbar-wrapper .link span {
            margin-left: 10px;
            font-size: 1.5em;
            font-weight: 700;
            color: #e94560;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .swagger-ui .info {
            margin: 30px 0;
        }
        
        .swagger-ui .info .title {
            font-size: 2.5em;
            font-weight: 700;
            background: linear-gradient(135deg, #e94560, #0f3460);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .swagger-ui .info .description p {
            font-size: 1.1em;
            line-height: 1.6;
            color: #555;
        }
        
        .swagger-ui .opblock {
            border-radius: 8px;
            margin: 10px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            transition: all 0.2s ease;
        }
        
        .swagger-ui .opblock:hover {
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }
        
        .swagger-ui .opblock .opblock-summary-method {
            border-radius: 4px;
            font-weight: 700;
            min-width: 80px;
        }
        
        .swagger-ui .opblock.opblock-get {
            border-color: #61affe;
            background: rgba(97, 175, 254, 0.08);
        }
        
        .swagger-ui .opblock.opblock-post {
            border-color: #49cc90;
            background: rgba(73, 204, 144, 0.08);
        }
        
        .swagger-ui .opblock.opblock-put {
            border-color: #fca130;
            background: rgba(252, 161, 48, 0.08);
        }
        
        .swagger-ui .opblock.opblock-delete {
            border-color: #f93e3e;
            background: rgba(249, 62, 62, 0.08);
        }
        
        .swagger-ui .opblock.opblock-patch {
            border-color: #50e3c2;
            background: rgba(80, 227, 194, 0.08);
        }
        
        .swagger-ui .opblock-tag {
            font-size: 1.3em;
            font-weight: 600;
            padding: 15px 0;
            border-bottom: 2px solid #e94560;
            margin-bottom: 15px;
        }
        
        .swagger-ui .opblock-tag:hover {
            background: rgba(233, 69, 96, 0.05);
        }
        
        .swagger-ui .btn {
            border-radius: 4px;
            font-weight: 600;
            transition: all 0.2s ease;
        }
        
        .swagger-ui .btn.execute {
            background: linear-gradient(135deg, #e94560, #c73e54);
            border: none;
        }
        
        .swagger-ui .btn.execute:hover {
            background: linear-gradient(135deg, #c73e54, #a8354a);
            transform: translateY(-1px);
        }
        
        .swagger-ui section.models {
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        
        .swagger-ui section.models h4 {
            font-size: 1.2em;
            color: #1a1a2e;
        }
        
        .swagger-ui .model-title {
            font-weight: 600;
            color: #e94560;
        }
        
        .swagger-ui .parameter__name.required:after {
            color: #e94560;
        }
        
        .swagger-ui .response-col_status {
            font-weight: 700;
        }
        
        .swagger-ui table tbody tr td:first-of-type {
            font-weight: 600;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #a1a1a1;
        }
        
        /* Etherial branding */
        .etherial-branding {
            text-align: center;
            padding: 20px;
            color: #888;
            font-size: 0.9em;
            border-top: 1px solid #eee;
            margin-top: 40px;
        }
        
        .etherial-branding a {
            color: #e94560;
            text-decoration: none;
            font-weight: 600;
        }
        
        .etherial-branding a:hover {
            text-decoration: underline;
        }
        
        /* Theme overrides */
        ${themeCSS}
        
        /* User custom CSS */
        ${customCss}
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    
    <div class="etherial-branding">
        <p>📚 Documentation generated by <a href="https://github.com/etherial-ts" target="_blank">Etherial Framework</a></p>
    </div>
    
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                ${specScript}
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                validatorUrl: null,
                displayRequestDuration: true,
                filter: true,
                showExtensions: true,
                showCommonExtensions: true,
                tryItOutEnabled: true,
                requestSnippetsEnabled: true,
                persistAuthorization: true,
                withCredentials: false,
            });
            
            window.ui = ui;
            
            ${customJs}
        };
    </script>
</body>
</html>
`;
}
/**
 * Generate a minimal Redoc HTML page (alternative to Swagger UI)
 */
export function generateRedocHtml(config = {}) {
    const { title = 'API Documentation', specUrl = '/docs/openapi.json', spec, } = config;
    const specScript = spec
        ? `<script>
            Redoc.init(${JSON.stringify(spec)}, {
                scrollYOffset: 50,
                hideDownloadButton: false,
                expandResponses: "200,201",
                pathInMiddlePanel: true,
                jsonSampleExpandLevel: 2,
            }, document.getElementById('redoc-container'))
           </script>`
        : `<redoc spec-url='${specUrl}'></redoc>`;
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <div id="redoc-container"></div>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    ${spec ? '' : specScript}
    ${spec ? specScript : ''}
</body>
</html>
`;
}
export default {
    generateSwaggerUIHtml,
    generateRedocHtml,
};
//# sourceMappingURL=swagger-ui.js.map