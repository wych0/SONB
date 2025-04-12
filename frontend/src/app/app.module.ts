import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { NotifierModule, NotifierOptions } from 'angular-notifier';

const notifierOptions: NotifierOptions = {
  behaviour: {
    autoHide: 3000,
    onMouseover: 'pauseAutoHide',
    onClick: 'hide',
    showDismissButton: false,
  },
};

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    FormsModule,
    NotifierModule.withConfig(notifierOptions),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
