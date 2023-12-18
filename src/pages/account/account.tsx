import React from 'react'
import ReactDOM from 'react-dom/client'
import Header from '../../assets/templates/header'
import Struct from '../../assets/templates/struct'
import './account.scss'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Header />
    <h1>ACCOUNT PAGE</h1>
    <Struct />
  </React.StrictMode>
)
