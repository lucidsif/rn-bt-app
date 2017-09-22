import React, { Component } from 'react'
import { View, StatusBar, ListView, NativeModules, NativeEventEmitter, AppState } from 'react-native'
import ReduxNavigation from '../Navigation/ReduxNavigation'
import { connect } from 'react-redux'
import StartupActions from '../Redux/StartupRedux'
import ReduxPersist from '../Config/ReduxPersist'
// Styles
import styles from './Styles/RootContainerStyles'

const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

import BleManager from 'react-native-ble-manager'
const BleManagerModule = NativeModules.BleManager
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule)

class RootContainer extends Component {
  constructor () {
    super()

    this.state = {
      scanning: false,
      peripherals: new Map(),
      appState: ''
    }

    this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this)
    this.handleStopScan = this.handleStopScan.bind(this)
    this.handleUpdateValueForCharacteristic = this.handleUpdateValueForCharacteristic.bind(this)
    this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(this)
    this.handleAppStateChange = this.handleAppStateChange.bind(this)
  }

  componentDidMount () {
    // if redux persist is not active fire startup action
    if (!ReduxPersist.active) {
      this.props.startup()
    }

    AppState.addEventListener('change', this.handleAppStateChange)

    BleManager.start({showAlert: false})

    this.handlerDiscover = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral)
    this.handlerStop = bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan)
    this.handlerDisconnect = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral)
    this.handlerUpdate = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValueForCharacteristic)
  }

  handleAppStateChange (nextAppState) {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!')
      BleManager.getConnectedPeripherals([]).then((peripheralsArray) => {
        console.log('Connected peripherals: ' + peripheralsArray.length)
      })
    }
    // dispatch instead of setting local state
    this.setState({appState: nextAppState})
  }

  componentWillUnmount () {
    this.handlerDiscover.remove()
    this.handlerStop.remove()
    this.handlerDisconnect.remove()
    this.handlerUpdate.remove()
  }

  // refactor to redux
  handleDisconnectedPeripheral (data) {
    let peripherals = this.state.peripherals
    let peripheral = peripherals.get(data.peripheral)
    if (peripheral) {
      peripheral.connected = false
      peripherals.set(peripheral.id, peripheral)
      this.setState({peripherals})
    }
    console.log('Disconnected from ' + data.peripheral)
  }

  handleUpdateValueForCharacteristic (data) {
    console.log('Received data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value)
  }

  handleStopScan () {
    console.log('Scan is stopped')
    // dispatch action creator
    this.setState({ scanning: false })
  }

  startScan () {
    // get scanning state from props instead of local state
    if (!this.state.scanning) {
      BleManager.scan([], 3, true).then((results) => {
        console.log('Scanning...')
        // dispatch action creator to change state of scanning
        this.setState({scanning: true})
      })
    }
  }

  handleDiscoverPeripheral (peripheral) {
    // get peripherals state from props instead of locla state
    var peripherals = this.state.peripherals
    if (!peripherals.has(peripheral.id)) {
      console.log('Got ble peripheral', peripheral)
      peripherals.set(peripheral.id, peripheral)
      // dispatch peripherals action creator instead of settin state locally
      this.setState({ peripherals })
    }
  }
// refactor to redux
  test (peripheral) {
    if (peripheral) {
      if (peripheral.connected) {
        BleManager.disconnect(peripheral.id)
      } else {
        BleManager.connect(peripheral.id).then(() => {
          let peripherals = this.state.peripherals
          let p = peripherals.get(peripheral.id)
          if (p) {
            p.connected = true
            peripherals.set(peripheral.id, p)
            this.setState({peripherals})
          }
          console.log('Connected to ' + peripheral.id)

          this.setTimeout(() => {
            // Test using bleno's pizza example
            // https://github.com/sandeepmistry/bleno/tree/master/examples/pizza
            BleManager.retrieveServices(peripheral.id).then((peripheralInfo) => {
              console.log(peripheralInfo)
              var service = '13333333-3333-3333-3333-333333333337'
              var bakeCharacteristic = '13333333-3333-3333-3333-333333330003'
              var crustCharacteristic = '13333333-3333-3333-3333-333333330001'

              this.setTimeout(() => {
                BleManager.startNotification(peripheral.id, service, bakeCharacteristic).then(() => {
                  console.log('Started notification on ' + peripheral.id)
                  this.setTimeout(() => {
                    BleManager.write(peripheral.id, service, crustCharacteristic, [0]).then(() => {
                      console.log('Writed NORMAL crust')
                      BleManager.write(peripheral.id, service, bakeCharacteristic, [1, 95]).then(() => {
                        console.log('Writed 351 temperature, the pizza should be BAKED')
                      })
                    })
                  }, 500)
                }).catch((error) => {
                  console.log('Notification error', error)
                })
              }, 200)
            })
          }, 900)
        }).catch((error) => {
          console.log('Connection error', error)
        })
      }
    }
  }

  render () {
    const list = Array.from(this.state.peripherals.values())
    const dataSource = ds.cloneWithRows(list)

    this.startScan()

    console.log('BT-container', this.props)

    return (
      <View style={styles.applicationView}>
        <StatusBar barStyle='light-content' />
        <ReduxNavigation />
      </View>
    )
  }
}

const mapStateToProps = ({bluetooth}) => ({bluetooth})

// wraps dispatch to create nicer functions to call within our component
const mapDispatchToProps = (dispatch) => ({
  startup: () => dispatch(StartupActions.startup())
})

export default connect(mapStateToProps, mapDispatchToProps)(RootContainer)

// create the mapdispatch to props and mapstate to props