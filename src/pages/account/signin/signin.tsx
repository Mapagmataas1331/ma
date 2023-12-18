import React from 'react'
import ReactDOM from 'react-dom/client'
import Header from '../../../assets/templates/header'
import Struct from '../../../assets/templates/struct'
import './signin.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Header />
    <h1>SIGNIN PAGE</h1>
    <Struct />
  </React.StrictMode>
)
