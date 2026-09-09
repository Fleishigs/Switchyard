SetFont "Segoe UI" 9

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Your everyday workshop."
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Make room for your next good idea.$\r$\n$\r$\nImages. Audio. Video. Documents. Messages.$\r$\n111 useful tools, one familiar workspace.$\r$\n$\r$\nSwitchyard includes its local processing engines and voice models, so most tools are ready without another download.$\r$\n$\r$\nChoose Next to make it yours."
  !insertmacro MUI_PAGE_WELCOME
!macroend
