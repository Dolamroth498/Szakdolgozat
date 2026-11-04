import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GameControlService {
  private readonly pauseRequestedSubject = new Subject<void>();
  readonly pauseRequested$ = this.pauseRequestedSubject.asObservable();

  requestPause(): void {
    this.pauseRequestedSubject.next();
  }
}
