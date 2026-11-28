import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { CourseCatalogPage } from './CourseCatalogPage';
import { courseBookmarkApi } from '@/api/features/demo/course-bookmark.api';
const state=vi.hoisted(()=>({role:'STUDENT',allowed:true}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{email:'admin@example.com',role:'ADMIN'}})}));
vi.mock('@/hooks/usePermissions',()=>({usePermissions:()=>({activeRole:state.role,hasPermission:()=>state.allowed})}));
vi.mock('@/api',()=>({courseApi:{searchCatalog:vi.fn().mockResolvedValue({content:[],totalElements:0,totalPages:0}),getCatalogCategories:vi.fn().mockResolvedValue([])},certificateApi:{getMyCertificates:vi.fn().mockResolvedValue([])}}));
vi.mock('@/api/features/demo/course-bookmark.api',()=>({courseBookmarkApi:{getSavedIds:vi.fn().mockResolvedValue([]),getSavedCourses:vi.fn().mockResolvedValue({content:[],totalElements:0,totalPages:0}),save:vi.fn().mockResolvedValue({courseId:1,saved:true}),remove:vi.fn().mockResolvedValue({courseId:1,saved:false})}}));
vi.mock('@/components/layout/MainLayout',()=>({MainLayout:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock('../hooks/useCourseEnrollment',()=>({useCourseEnrollment:()=>({canEnroll:true,enrollmentByCourseId:new Map(),enrollmentsQuery:{isSuccess:true,data:[]},enrollMutation:{isPending:false}})}));
vi.mock('./CourseCard',()=>({CourseCard:()=>null,CourseCardSkeleton:()=>null}));
function Location(){return <output data-testid="location">{useLocation().pathname}</output>;}
function mount(embedded=false){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/courses']}><CourseCatalogPage embedded={embedded}/><Location/></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{state.role='STUDENT';state.allowed=true;vi.clearAllMocks();vi.mocked(courseBookmarkApi.getSavedIds).mockResolvedValue([]);vi.mocked(courseBookmarkApi.getSavedCourses).mockResolvedValue({content:[],totalElements:0,totalPages:0,number:0,size:12,first:true,last:true});});
it('shows the primary catalog action for an Admin in Student view and preserves keyboard navigation',async()=>{
 const user=userEvent.setup();mount();const button=screen.getByRole('button',{name:'For you · Recommended courses'});
 expect(button).toHaveAttribute('data-variant','default');expect(button).toHaveClass('min-h-11','w-full','sm:w-auto');
 expect(button.querySelector('svg')).toHaveAttribute('aria-hidden','true');button.focus();await user.keyboard('{Enter}');expect(screen.getByTestId('location')).toHaveTextContent('/student/recommendations');
});
it.each(['ADMIN','TEACHER'])('hides the catalog action in normal %s view',role=>{state.role=role;mount();expect(screen.queryByRole('button',{name:'For you · Recommended courses'})).not.toBeInTheDocument();});
it('keeps the action out of embedded catalogs',()=>{mount(true);expect(screen.queryByRole('button',{name:'For you · Recommended courses'})).not.toBeInTheDocument();});
it('requires enrollment permission',()=>{state.allowed=false;mount();expect(screen.queryByRole('button',{name:'For you · Recommended courses'})).not.toBeInTheDocument();});
it('switches to saved courses filter and displays empty state when none saved',async()=>{
 const user=userEvent.setup();
 vi.mocked(courseBookmarkApi.getSavedIds).mockResolvedValue([101,102]);
 mount();
 const savedButton=await screen.findByRole('button',{name:/Saved courses \(2\)/});
 await user.click(savedButton);
 await waitFor(()=>expect(courseBookmarkApi.getSavedCourses).toHaveBeenCalledTimes(1));
 expect(await screen.findByText('No saved courses yet')).toBeInTheDocument();
});
