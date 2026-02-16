// Bicep template for Azure Container Apps deployment
// Usage: az deployment sub create --location eastus --template-file azure/main.bicep --parameters @azure/parameters.json

targetScope = 'resourceGroup'

@description('Application name')
param appName string = 'sds-solution'

@description('Azure region')
param location string = resourceGroup().location

@description('Container image (ACR or Docker Hub)')
param image string

@description('ACR login server (optional, for private registry)')
param acrLoginServer string = ''

@description('ACR username (optional)')
param acrUsername string = ''

@description('ACR password (optional)')
param acrPassword string = ''

@description('Environment variables for the container')
param envVars array = []

var containerAppsEnvironmentName = '${appName}-env'
var containerAppName = '${appName}-app'
var logAnalyticsName = '${appName}-logs'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registry: acrLoginServer != '' ? [{
        server: acrLoginServer
        username: acrUsername
        passwordSecretRef: 'acr-password'
      }] : []
      secrets: acrPassword != '' ? [{
        name: 'acr-password'
        value: acrPassword
      }] : []
    }
    template: {
      containers: [{
        name: appName
        image: image
        resources: {
          cpu: json('0.5')
          memory: '1Gi'
        }
        env: envVars
      }]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [{
          name: 'http-scaling'
          http: {
            metadata: { concurrentRequests: '10' }
            auth: []
          }
        }]
      }
    }
  }
}

output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
