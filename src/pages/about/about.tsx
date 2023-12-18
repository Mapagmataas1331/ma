import React from 'react'
import ReactDOM from 'react-dom/client'
import Header from '../../assets/templates/header'
import Struct from '../../assets/templates/struct'
import './adout.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Header />
    <h1>ABOUT PAGE</h1>
    <Struct />
  </React.StrictMode>
)
